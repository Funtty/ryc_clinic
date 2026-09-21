import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowRight } from "lucide-react";
import type { Service } from "@prisma/client";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type ServiceCardProps = {
  service: Pick<
    Service,
    | "slug"
    | "name"
    | "shortDescription"
    | "durationMinutes"
    | "price"
    | "currency"
    | "priceLabel"
    | "imageUrl"
  >;
};

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <Card
      as={Link}
      href={`/services/${service.slug}`}
      variant="panel-lg"
      hover="lift"
      className="group flex h-full flex-col overflow-hidden"
    >
      {service.imageUrl && (
        <div className="relative aspect-[16/10] overflow-hidden bg-pine-100">
          <Image
            src={service.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-lg font-semibold leading-snug text-ink">
          {service.name}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-sub">
          {service.shortDescription}
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-pine-900/8 pt-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-faint">
            <Clock className="size-3.5" aria-hidden="true" />
            {service.durationMinutes} min
          </span>
          <span className="text-sm font-bold text-pine-800">
            {service.priceLabel ??
              (service.price != null
                ? `from ${formatMoney(service.price, service.currency)}`
                : "Price on consultation")}
          </span>
        </div>

        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-700">
          Learn more
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}