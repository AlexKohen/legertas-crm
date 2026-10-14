import "./globals.css";

export const metadata = {
  title: "Legertas.lt CRM",
  description: "Secure Legertas.lt customer relationship management"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
