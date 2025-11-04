import React, { FC, ReactNode, FormEvent } from "react";

interface FormProps {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  className?: string;
}

const Form: FC<FormProps> = ({ onSubmit, children, className }) => {
  return (
    <form
      onSubmit={(_event) => {
        _event.preventDefault(); // Prevent default form submission
        onSubmit(_event);
      }}
      className={` ${className}`} // Default spacing between form fields
    >
      {children}
    </form>
  );
};

export default Form;
