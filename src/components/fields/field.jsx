import React from 'react';
import { useField } from 'formik';
import { Form } from 'react-bootstrap';

function Field({ children, name, label }) {
  const [field, meta, helpers] = useField(name);

  return (
    <Form.Group controlId={name}>
      {label && (
        <Form.Label>{label}</Form.Label>
      )}
      {children(field, meta, helpers)}
      {meta.error && meta.touched && (
        <Form.Control.Feedback type="invalid">{meta.error}</Form.Control.Feedback>
      )}
    </Form.Group>
  );
}
export default Field;
