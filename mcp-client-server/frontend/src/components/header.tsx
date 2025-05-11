import Link from "next/link";

export function Header() {
  return (
    <header>
      <nav>
        <ul>
          <li>
            <Link href="/#">SSE - astream Chat</Link>
          </li>
          <li>
            <Link href="/#">SSE - atream_events Chat</Link>
          </li>
          <li>
            <Link href="/#">Wbsockets - Chat</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
