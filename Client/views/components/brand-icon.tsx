import Image from "next/image";

export function BrandIcon({ className }: { className: string }) {
  return <Image
    src="/icons/bhw-records-192.png"
    alt=""
    width={192}
    height={192}
    className={className}
  />;
}
