import Link from "next/link";

type BrandLockupProps = {
  href: string;
  variant?: "sidebar" | "public";
};

export default function BrandLockup({
  href,
  variant = "sidebar",
}: BrandLockupProps) {
  return (
    <Link
      className={`brandLockup brandLockup-${variant}`}
      href={href}
      aria-label="E-Kachra Mitra home"
    >
      <span className="brandMark" aria-hidden="true">EK</span>
      <span className="brandWordmark">
        <strong>E-Kachra Mitra</strong>
        <small>CIRCULAR TECHNOLOGY</small>
      </span>
    </Link>
  );
}
