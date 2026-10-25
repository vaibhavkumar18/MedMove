
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void | Promise<void>;
}

export default function ErrorState({
  message,
  onRetry,
}: ErrorStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleRetry() {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);

    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <section
      className="error-state error-state-enhanced"
      role="alert"
      aria-live="polite"
    >
      <div className="error-state-icon" aria-hidden="true">
        <AlertCircle size={21} strokeWidth={1.8} />
      </div>

      <div className="error-state-content">
        <strong>We couldn’t load this</strong>

        <p>
          {message ||
            'Something went wrong while loading this information. Please try again.'}
        </p>

        {onRetry && (
          <button
            type="button"
            className="button button-secondary button-small error-retry-button"
            onClick={() => void handleRetry()}
            disabled={isRetrying}
          >
            <RefreshCw
              size={14}
              className={isRetrying ? 'error-retry-spinner' : undefined}
            />
            {isRetrying ? 'Retrying…' : 'Try again'}
          </button>
        )}
      </div>
    </section>
  );
}
