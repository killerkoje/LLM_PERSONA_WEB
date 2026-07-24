import Image from "next/image";
import Link from "next/link";

type Props = {
  slug: string;
  name: string;
  src: string;
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  href?: string;
  linkable?: boolean;
};

const sizes = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
} as const;

export function Avatar({
  slug,
  name,
  src,
  size = "md",
  ring = false,
  href,
  linkable = true,
}: Props) {
  const px = sizes[size];
  const img = (
    <span
      className={`avatar ${ring ? "avatar-ring" : ""}`}
      style={{ width: px, height: px }}
    >
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        className="avatar-img"
      />
    </span>
  );

  if (!linkable) return img;

  return (
    <Link
      href={href ?? `/persona/${slug}`}
      className="avatar-link"
      aria-label={`${name} 프로필`}
    >
      {img}
    </Link>
  );
}
