import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="#16a34a"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Intellectory Logo"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM8 11V9H16V11H8ZM8 15V13H16V15H8Z"
    />
  </svg>
);

export default Logo;
