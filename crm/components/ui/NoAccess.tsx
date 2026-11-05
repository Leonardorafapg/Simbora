export default function NoAccess({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 h-full py-24 px-6">
      <h1 className="text-xl font-semibold text-text">Sem acesso</h1>
      <p className="text-sm text-text-muted max-w-sm">{message}</p>
    </div>
  );
}
