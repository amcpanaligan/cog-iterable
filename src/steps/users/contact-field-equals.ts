import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { FieldDefinition, RunStepResponse, Step, StepDefinition, StepRecord, RecordDefinition } from '../../proto/cog_pb';

import { baseOperators } from '../../client/constants/operators';
import * as util from '@run-crank/utilities';
import { isObject } from 'util';

/**
 * Note: the class name here becomes this step's stepId.
 @see BaseStep.getId()
 */
export class ContactFieldEquals extends BaseStep implements StepInterface {

  protected stepName: string = 'Check a field on an Iterable Contact';

  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;

  protected stepExpression: string = 'the (?<field>[a-zA-Z0-9_ ]+) field on iterable contact (?<email>.+) should (?<operator>be less than|be greater than|be|contain|not be|not contain) (?<expectedValue>.+)';

  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: "Contact's email address",
  },
  {
    field: 'field',
    type: FieldDefinition.Type.STRING,
    description: 'Field name to check',
  },
  {
    field: 'operator',
    type: FieldDefinition.Type.STRING,
    description: 'Check Logic (one of be less than, be greater than, be, contain, not be, or not contain)',
  },
  {
    field: 'expectedValue',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'Expected field value',
  }];

  protected expectedRecords: ExpectedRecord[] = [{
    id: 'contact',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'email',
      type: FieldDefinition.Type.EMAIL,
      description: "Contact's Email Address",
    }, {
      field: 'signupDate',
      type: FieldDefinition.Type.DATETIME,
      description: 'The date/time the Contact was created',
    }, {
      field: 'profileUpdatedAt',
      type: FieldDefinition.Type.DATETIME,
      description: 'The date/time the Contact was updated',
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step): Promise<RunStepResponse> {
    let apiRes: any;
    const stepData: any = step.getData().toJavaScript();
    const email: string = stepData.email;
    const field: string = stepData.field;
    const operator: string = stepData.operator;
    const expectedValue: string = stepData.expectedValue;

    try {
      apiRes = await this.client.getContactByEmail(email);
      if (!apiRes.user) {
        // If no results were found, return an error.
        return this.error('No contact found for email %s', [email]);
      } else if (!apiRes.user.dataFields.hasOwnProperty(field)) {
        // If the given field does not exist on the contact, return an error.111
        return this.error('The %s field does not exist on contact %s', [field, email]);
      } else if (this.compare(operator, apiRes.user.dataFields[field], expectedValue)) {
        // If the value of the field matches expectations, pass.
        const contactRecord = this.createRecord(apiRes.user.dataFields);
        return this.pass(util.operatorSuccessMessages[operator], [field, expectedValue], [contactRecord]);
      } else {
        // If the value of the field does not match expectations, fail.
        const contactRecord = this.createRecord(apiRes.user.dataFields);
        return this.fail(util.operatorFailMessages[operator], [field, expectedValue, apiRes.user.dataFields[field]], [contactRecord]);
      }
    } catch (e) {
      if (e instanceof util.UnknownOperatorError) {
        return this.error('%s Please provide one of: %s', [e.message, baseOperators]);
      }
      if (e instanceof util.InvalidOperandError) {
        return this.error(e.message);
      }
      if (e.response.status == 401) {
        return this.error('Credentials are invalid. Please check them and try again.');
      }
      return this.error('There was an error during validation: %s', [e.message]);
    }
  }

  public createRecord(contact): StepRecord {
    const obj = {};
    const dateFormat = /[0-9]+-[0-9]+-[0-9]+ [0-9]+:[0-9]+:[0-9]+ [+0-9]+:[0-9]+/;
    Object.keys(contact).forEach((key: string) => {
      if (!isObject(contact[key])) {
        obj[key] = contact[key];
      }
      if (dateFormat.test(obj[key])) {
        obj[key] = (new Date(obj[key])).toISOString();
      }
    });
    const record = this.keyValue('contact', 'Checked Contact', obj);
    return record;
  }
}

// Exports a duplicate of this class, aliased as "Step"
// See the constructor in src/core/cog.ts to understand why.
export { ContactFieldEquals as Step };
