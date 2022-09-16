import { createTheme } from '@mui/material';
import colors from './colors.module.scss';

const TEXT_COLOR = 'rgba(255, 255, 255, 0.93)';
const BG_COLOR = colors.bgColor;

const HOVER_COLOR = '#4b9b73';

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
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
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
          color: 'inherit',
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
        },
        input: {
          '&:hover, &:focus, &:focus-visible': {
            outline: 'inherit',
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
