import Image from "next/image";
import type { Dentist } from "@prisma/client";
import { Card } from "@/components/ui/card";

type TeamCardProps = {
  dentist: Pick<
    Dentist,
    "slug" | "name" | "title" | "bio" | "specialties" | "photoUrl"
  >;
};

export function TeamCard({ dentist }: TeamCardProps) {
  const specialties = dentist.specialties
    ? dentist.specialties.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <Card
      as="article"
      variant="panel-lg"
      hover="lift"
      className="group flex h-full flex-col overflow-hidden"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-pine-100">
        {dentist.photoUrl ? (
          <Image
            src={dentist.photoUrl}
            alt={`Portrait of ${dentist.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-5xl text-pine-300">
              {dentist.name.replace("Dr. ", "").charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-lg font-semibold text-ink">
          {dentist.name}
        </h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-gold-700">
          {dentist.title}
        </p>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-sub">
          {dentist.bio}
        </p>

        {specialties.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {specialties.map((s) => (
              <span
                key={s}
                className="rounded-full bg-pine-50 px-2.5 py-1 text-[0.7rem] font-medium text-pine-700"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}