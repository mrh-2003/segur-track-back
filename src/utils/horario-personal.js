'use strict';
// Un turno nocturno pertenece al día en que empieza la jornada habitual.
const cubreHorario = (p, inicio, fin) => {
  const local = new Date(+new Date(inicio) - 5 * 3600000);
  const finMs = +new Date(fin);
  const dias = p.dias_laborales || [0, 1, 2, 3, 4, 5, 6];
  if (!p.horario_inicio || !p.horario_fin) return dias.includes(local.getUTCDay());
  for (const offset of [-1, 0]) {
    const dia = new Date(local);
    dia.setUTCDate(dia.getUTCDate() + offset);
    if (!dias.includes(dia.getUTCDay())) continue;
    const fecha = dia.toISOString().slice(0, 10);
    const a = +new Date(`${fecha}T${p.horario_inicio}-05:00`);
    let b = +new Date(`${fecha}T${p.horario_fin}-05:00`);
    if (b <= a) b += 86400000;
    if (+new Date(inicio) >= a && finMs <= b) return true;
  }
  return false;
};
module.exports = { cubreHorario };
