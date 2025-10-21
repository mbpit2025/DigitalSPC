// src/components/form/Select.tsx (The corrected file)

import React from "react";

interface Option {
  value: string;
  label: string;
}

// 📌 CORRECTED INTERFACE: Added the 'value' prop
export interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  
  // 💡 This prop is required to make the component "controlled" 
  // and eliminates the TypeScript error in the parent component.
  value: string; 
}

// 📌 CORRECTED COMPONENT: Removed internal state
const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  className = "",
  // 💡 The 'value' prop is now passed directly from the parent state
  value, 
}) => {

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    // We only notify the parent; the parent will update the 'value' prop.
    onChange(newValue); 
  };

  return (
    <select
      className={`h-11 w-full appearance-none rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${
        // Use the external 'value' prop to determine the color state
        value
          ? "text-gray-800 dark:text-white/90"
          : "text-gray-400 dark:text-gray-400"
      } ${className}`}
      // 💡 Controlled: Value is taken from props
      value={value} 
      onChange={handleChange}
    >
      {/* Placeholder option */}
      <option
        value=""
        disabled
        className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
      >
        {placeholder}
      </option>
      {/* Map over options */}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
        >
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;