export default function handler(req: any, res: any) {
  console.log('[TEST LOGIN] handler invoked', req.method, req.url);
  res.status(200).json({ ok: true, path: req.url });
}
