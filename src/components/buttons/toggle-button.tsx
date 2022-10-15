import React from 'react';
import { ButtonProps, IconButton } from '@mui/material';
import { ToggleOff, ToggleOn } from '@mui/icons-material';
import style from './style.module.scss';

interface Props extends ButtonProps {
  children?: React.ReactNode;
  enabled: boolean;
  onToggle: (...args: any) => void;
  disabled?: boolean;
  useColors?: boolean;
  classes?: string;
}

const ToggleButton : React.FC<Props> = ({
  children, enabled, onToggle,
  disabled, useColors = true, classes = '',
  ...props
}) => {
  let value = enabled;

  const colorClass = useColors ? style[`toggle-btn--${value ? 'on' : 'off'}`] : '';
  const disabledClass = disabled ? style['toggle-btn--disabled'] : '';

  const handleToggle = (_event: React.MouseEvent<unknown>) => {
    const newValue = !value;
    value = newValue;
    onToggle(newValue);
  };

  return (
    <IconButton
      className={`${style['toggle-btn']} ${colorClass} ${disabledClass} ${classes}`}
      onClick={disabled ? undefined : handleToggle}
      {...props}
    >
      {value ? <ToggleOn /> : <ToggleOff />}
      {children}
    </IconButton>
  );
};

export default ToggleButton;
