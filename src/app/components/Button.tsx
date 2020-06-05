import React, { HTMLProps } from 'react';
import classNames from 'classnames';

type ButtonProps = HTMLProps<HTMLButtonElement> & {
  className?: string;
  type?: 'primary' | 'secondary' | 'primary-destructive' | 'secondary-destructive';
  children?: React.ReactNode;
};

const Button = ({ className, children, type = 'primary', ...rest }: ButtonProps) => (
  <button
    className={classNames(className, 'button', {
      [`button--${type}`]: type,
    })}
    {...rest}
  >
    {children}
  </button>
);

export default Button;
