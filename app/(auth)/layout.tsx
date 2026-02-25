export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen w-full place-items-center bg-muted/30 p-4">
      {children}
    </div>
  );
}
