type Theme = 'light' | 'dark'

type Props = {
  theme: Theme
  onChange: () => void
}

function ThemeToggle({ theme, onChange }: Props) {
  return (
    <div className="theme-switch">
      <input
        type="checkbox"
        className="checkbox"
        id="theme-toggle"
        checked={theme === 'dark'}
        onChange={onChange}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      />
      <label htmlFor="theme-toggle" className="label">
        <svg
          className="moon"
          width="24"
          height="24"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 11.5066C3 16.7497 7.25034 21 12.4934 21C16.2209 21 19.4466 18.8518 21 15.7259C12.4934 15.7259 8.27411 11.5066 8.27411 3C5.14821 4.55344 3 7.77915 3 11.5066Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          className="sun"
          width="24"
          height="24"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M22 12L23 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 2V1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 23V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 20L19 19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 4L19 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 20L5 19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 4L5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 12L2 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="ball" />
      </label>
    </div>
  )
}

export default ThemeToggle
