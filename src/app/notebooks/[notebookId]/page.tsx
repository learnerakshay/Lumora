import { NotebookDetail } from "@/components/notebooks/notebook-detail";
export default async function NotebookPage({
  params,
}: {
  params: Promise<{ notebookId: string }>;
}) {
  const { notebookId } = await params;
  return <NotebookDetail notebookId={notebookId} />;
}
