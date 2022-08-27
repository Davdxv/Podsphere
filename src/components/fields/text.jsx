import React from 'react';
import { Form } from 'react-bootstrap';
import Field from './field';

function TextField({ name, label, ...props }) {
  return (
    <Field name={name} label={label}>
      {field => (
        <Form.Control {...props} {...field} />
      )}
    </Field>
  );
}
export default TextField;
