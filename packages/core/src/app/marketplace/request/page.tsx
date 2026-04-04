import PublicRequestForm from "./ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-2xl font-bold mb-2">Request a Marketplace Item</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Submit a product you want added to the catalog. All fields marked with * are required. Provide clear information and at least one image URL. Moderators will review your request.
      </p>
      <PublicRequestForm />
    </div>
  );
}
