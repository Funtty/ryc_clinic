import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ErrorCardProps = {
  onReset: () => void;
};

export function ErrorCard({ onReset }: ErrorCardProps) {
  return (
    <div className="mx-auto max-w-lg">
      <Alert tone="error" title="Something went wrong">
        We hit an unexpected error while rendering this page. Your data is safe —
        please try again.
      </Alert>
      <div className="mt-6">
        <Button onClick={onReset}>Try again</Button>
      </div>
    </div>
  );
}