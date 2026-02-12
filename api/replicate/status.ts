
// DEPRECATED - Use app/api/replicate/route.ts
export default async function handler(req: any, res: any) {
  res.status(404).json({ error: "API Route Moved. Please use /api/replicate" });
}
