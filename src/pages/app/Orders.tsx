const Orders = () => (
  <div>
    <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">Pedidos</h1>
    <p className="text-muted-foreground mb-8">Pedidos sincronizados dos marketplaces</p>
    <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
      <p className="text-muted-foreground">Nenhum pedido sincronizado. Configure a integração com o Bling.</p>
    </div>
  </div>
);

export default Orders;
