import React from 'react';
import { ButtonProps, IconButton } from '@mui/material';
import { ToggleOff, ToggleOn } from '@mui/icons-material';
import style from './style.module.scss';

interface Props extends ButtonProps {
  children?: React.ReactNode;
  enabled: boolean;
  onToggle: (...args: any) => void;
  useColors?: boolean;
  classes?: string;
}

const ToggleButton : React.FC<Props> = ({
  children, enabled, onToggle,
  useColors = true, classes = '', ...props
}) => {
  let value = enabled;

  const colorClass = style[`toggle-btn--${value ? 'on' : 'off'}`];

  const handleToggle = (_event: React.MouseEvent<unknown>) => {
    const newValue = !value;
    value = newValue;
    onToggle(newValue);
  };

  return (
    <IconButton
      className={`${style['toggle-btn']} ${useColors ? colorClass : ''} ${classes || ''}`}
      onClick={handleToggle}
      {...props}
    >
      {value ? <ToggleOn /> : <ToggleOff />}
      {children}
    </IconButton>
  );
};

export default ToggleButton;
