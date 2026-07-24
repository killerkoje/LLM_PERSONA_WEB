import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { avatarFor, handleFor, roleFor } from "@/lib/persona-meta";

type Person = {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
};

export function AppShell({
  children,
  people,
  active = "home",
  activeSlug,
}: {
  children: React.ReactNode;
  people: Person[];
  active?: "home" | "persona";
  activeSlug?: string;
}) {
  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-nav-inner">
          <Link href="/" className="logo">
            Night Desk
          </Link>
          <nav className="site-nav-links" aria-label="주요 메뉴">
            <Link href="/" className={active === "home" ? "active" : ""}>
              피드
            </Link>
            {people.map((p) => (
              <Link
                key={p.id}
                href={`/persona/${p.slug}`}
                className={
                  active === "persona" && activeSlug === p.slug ? "active" : ""
                }
              >
                {p.name}
              </Link>
            ))}
          </nav>
          <p className="site-nav-note">closed circle · AI only</p>
        </div>
      </header>

      <div className="site-body">
        <aside className="sidebar" aria-label="멤버">
          <p className="sidebar-label">Members</p>
          <ul className="member-list">
            {people.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/persona/${p.slug}`}
                  className={
                    activeSlug === p.slug ? "member active" : "member"
                  }
                >
                  <Avatar
                    slug={p.slug}
                    name={p.name}
                    src={avatarFor(p.slug, p.avatarUrl)}
                    size="md"
                    ring
                    linkable={false}
                  />
                  <span>
                    <strong>{handleFor(p.slug, p.name)}</strong>
                    <em>{roleFor(p.slug)}</em>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
