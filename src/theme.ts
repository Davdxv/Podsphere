import { createTheme } from '@mui/material';
import colors from './theme/colors.module.scss';
import breakpoints from './theme/breakpoints.module.scss';
import { isValidString } from './utils';
import { throwDevError } from './errors';

const isColor = (strColor: any) : strColor is string => {
  const s = new Option().style;
  s.color = strColor;
  return s.color !== '';
};

const convertBreakpointStringToNumber = (value: unknown) => {
  const regEx = /[0-9]+px/;
  if (isValidString(value) && regEx.test(value)) return Number(value.split('px')[0]);
  throwDevError('SCSS exported breakpoint is not valid', value);
};

const { tableTextColor, bgColor, tabHoverColor } = colors;
const { xs, sm, md, lg, xl } = breakpoints;

if (!isColor(tableTextColor) || !isColor(bgColor) || !isColor(tabHoverColor)) {
  throwDevError('SCSS exported colors are not available');
}

const TEXT_COLOR = tableTextColor;
const BG_COLOR = bgColor;
const HOVER_COLOR = tabHoverColor;

const SHARED_TABLE_STYLES = {
  backgroundColor: BG_COLOR,
  color: TEXT_COLOR,
};

export const theme = createTheme({
  palette: {
    primary: {
      main: TEXT_COLOR,
    },
  },
  breakpoints: {
    values: {
      xs: convertBreakpointStringToNumber(xs),
      sm: convertBreakpointStringToNumber(sm),
      md: convertBreakpointStringToNumber(md),
      lg: convertBreakpointStringToNumber(lg),
      xl: convertBreakpointStringToNumber(xl),
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'unset',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        root: {
          zIndex: 999999,
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: 'white',
          '&.MuiSelect-icon': {
            fill: 'white',
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          color: TEXT_COLOR,
        },
      },
    },
    MuiTableSortLabel: {
      styleOverrides: {
        icon: {
          color: TEXT_COLOR,
          opacity: 0.3,
        },
        root: {
          '&:hover, &:focus, &.Mui-active, &.Mui-active .MuiTableSortLabel-icon': {
            color: TEXT_COLOR,
          },
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          ...SHARED_TABLE_STYLES,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          ...SHARED_TABLE_STYLES,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          color: TEXT_COLOR,
          backgroundColor: 'inherit',
          cursor: 'default',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: 'inherit',
          backgroundColor: 'inherit',
          whiteSpace: 'normal',
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          color: 'inherit',
          backgroundColor: 'inherit',
          overflow: 'hidden',
          flexGrow: '1',
          '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
            margin: '0 auto',
          },
          '& .MuiSelect-nativeInput': {
            opacity: 1,
          },
        },
        select: {
          paddingRight: '0.5rem',
        },
        selectIcon: {
          fill: `${BG_COLOR} !important`,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'gray',
          '&:hover, &:focus, &:focus-visible': {
            outline: 'inherit',
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          color: 'inherit',
          '&:hover, &:focus, &:focus-visible': {
            outline: 'inherit',
          },
        },
        input: {
          paddingLeft: '2px',
          paddingRight: '2px',
          width: '95%',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: TEXT_COLOR,
        },
        root: {
          color: 'inherit',
          backgroundColor: 'inherit',
          '&:hover, &:focus, &:focus-visible': {
            '& > fieldset': {
              borderColor: 'unset !important',
            },
          },
        },
        input: {
          '&:hover, &:focus, &:focus-visible': {
            outline: 'inherit',
          },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          color: 'inherit',
          backgroundColor: 'inherit',
          '&.Mui-disabled': {
            color: 'gray',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: HOVER_COLOR,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '&:hover': {
            color: HOVER_COLOR,
            transition: 'all 0.3s ease',
          },
          '&.Mui-selected': {
            color: HOVER_COLOR,
          },
        },
      },
    },
  },
});
