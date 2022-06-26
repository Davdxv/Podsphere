import React from 'react';
import { Button } from 'react-bootstrap';
import { MdOutlineOpenInFull, MdOutlineCloseFullscreen } from 'react-icons/md';
import style from 'style.module.scss';
// const BtnIconOpen = styled(MdOutlineOpenInFull)`
//   font-size: 1.25rem;
//   line-height: 1.75rem;
// `;

// const BtnIconClose = styled(MdOutlineCloseFullscreen)`
//   font-size: 1.25rem;
//   line-height: 1.75rem;
// `;

// const Btn = styled(Button)`
//   align-items: center;
//   background-color: #030303;
//   border: 1px solid transparent;
//   box-shadow: none !important;
//   border-radius: 50%;
//   display: flex;
//   height: 40px;
//   justify-content: center;
//   position: absolute;
//   left: 35px;
//   width: 40px;
//   z-index: 9999;
//   top: 250px;
//   animation: glowing 1300ms infinite;
//   @keyframes glowing {
//   0% {
//     background-color: #030303;
//     box-shadow: 0 0 3px #030303;
//   }
//   50% {
//     background-color: #0f0f0f;
//     box-shadow: 0 0 10px #0d0d0d;
//     border-color: #212529;
//   }
//   100% {
//     background-color: #030303;
//     box-shadow: 0 0 3px #030303;
//   }
// }
// `;

interface Props {
  collapseGroups: () => void,
  expandGroups: () => void,
  toggle?: boolean,
}

const ToggleBtn : React.FC<Props> = ({
  collapseGroups,
  expandGroups,
  toggle = false,
}) => (
  <Button
    className={style.btn}
    onClick={toggle ? expandGroups : collapseGroups}
  >
    {toggle ? <MdOutlineOpenInFull className={style['btn-icon-open']} />
      : <MdOutlineCloseFullscreen className={style['btn-icon-close']} /> }
  </Button>
);

export default ToggleBtn;
