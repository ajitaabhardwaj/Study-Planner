import "./globals.css";

export const metadata = {
  title: "Study Planner",
  description: "A local-first daily planner for timed study, prep plans, and due-date to-dos.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
