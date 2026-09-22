"use client";

/**
 * Dentist filter for the admin calendar. Lives in a client component because
 * it navigates on change; the parent calendar page is a Server Component (and
 * event handlers may not cross that boundary). Hidden inputs keep a no-JS GET
 * submit working (e.g. keyboard/assistive tech without the change handler).
 */

type DentistOption = { id: string; name: string };

export function DentistFilter({
  dentists,
  value,
  view,
  date,
}: {
  dentists: DentistOption[];
  value: string;
  view: string;
  date: string;
}) {
  return (
    <form method="get" className="flex items-center gap-2">
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="date" value={date} />
      <label className="sr-only" htmlFor="dentist-filter">
        Filter by dentist
      </label>
      <select
        id="dentist-filter"
        name="dentist"
        defaultValue={value}
        onChange={(e) => {
          const url = new URL(window.location.href);
          if (e.target.value) url.searchParams.set("dentist", e.target.value);
          else url.searchParams.delete("dentist");
          window.location.href = url.toString();
        }}
        className="input-field h-11 w-full sm:w-64"
      >
        <option value="">All dentists</option>
        {dentists.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </form>
  );
}