import React from 'react';
import {
  Button, ButtonProps,
  Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';
import style from './alert-dialog.module.scss';

type FunctionHandler = (...args: any) => void;
type DialogButton = [string, FunctionHandler, ButtonProps?];

interface AlertDialogProps {
  onClose: FunctionHandler,
  isOpen: boolean,
  title: string,
  description: string,
  buttons: DialogButton[],
}

const AlertDialog : React.FC<AlertDialogProps> = ({
  onClose, isOpen, title, description, buttons,
}) => {
  const handleClose = (_event: React.MouseEvent<unknown>, _reason = '') => {
    onClose();
  };

  return (
    <Dialog
      className={style['alert-dialog']}
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {description}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {buttons.map(([buttonText, handler, props]) => (
          <Button
            className={style['alert-action-button']}
            key={buttonText}
            onClick={handler}
            {...(props || {})}
          >
            {buttonText}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};
export default AlertDialog;
