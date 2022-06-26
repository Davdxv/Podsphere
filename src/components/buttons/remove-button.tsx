import React from 'react';
import styled from 'styled-components';
import { Button } from 'react-bootstrap';
import { CgTrash } from 'react-icons/cg';
import style from './style.module.scss';
// const MinusIcon = styled(CgTrash)`
//   font-size: 1.25rem;
//   line-height: 1.75rem;
// `;
// const DeleteBtn = styled(Button)`
//   padding: 0.25rem 0.5rem;
//   line-height: 1.75rem;
//   border-radius: 50%;
//   background: transparent;
//   border: 1px solid transparent;
//   color: #bd0c0c ;
//   box-shadow: none !important;
//   &:hover {
//     color: #641c0f;
//     background: transparent;
//     border: 1px solid transparent;
//   }
// `;

interface Props {
  onClick: () => void;
}

const RemoveBtn : React.FC<Props> = ({
  onClick,
  ...props
}) => (
  <Button
    className={style['delete-btn']}
    onClick={onClick}
    {...props}
  >
    <CgTrash className={style['minus-icon']} />
  </Button>
);

export default RemoveBtn;
