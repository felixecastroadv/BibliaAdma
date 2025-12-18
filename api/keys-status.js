
// Placeholder para monitoramento de saúde das chaves API
export default async function handler(req, res) {
  res.status(200).json({ 
    healthy: 1, 
    total: 1, 
    healthPercentage: 100,
    keys: [{ name: "Chave Primária", status: "active", mask: "AIza...XyZ", latency: 120, msg: "OK" }]
  });
}
