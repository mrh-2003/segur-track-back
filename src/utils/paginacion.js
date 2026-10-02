'use strict';

const paginacion = (query) => {
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(query.limite, 10) || 20));
  const offset = (pagina - 1) * limite;
  return { pagina, limite, offset };
};

const metaPaginacion = (pagina, limite, total) => ({
  pagina,
  limite,
  total,
  totalPaginas: Math.ceil(total / limite),
});

module.exports = { paginacion, metaPaginacion };
