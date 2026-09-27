export default async function handler(req, res) {
  try {
    const { id } = req.query;
    const token = process.env.META_ACCESS_TOKEN;
    const r = await fetch(`https://graph.facebook.com/v19.0/${id}?fields=status_code&access_token=${token}`);
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
