import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Filter,
  Grid2X2,
  Target,
  UsersRound,
} from 'lucide-react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const MONTH_OPTIONS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const META_SEMANAL = 2646;

const readField = (row, names) => {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name];
  }
  const keys = Object.keys(row);
  const normalized = keys.reduce((acc, key) => {
    acc[key.toLowerCase().replace(/\s+/g, '_')] = key;
    return acc;
  }, {});
  for (const name of names) {
    const key = normalized[name.toLowerCase().replace(/\s+/g, '_')];
    if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
};

const parseDate = (row) => {
  const rawDate = readField(row, ['fecha', 'fecha_consulta', 'fecha_evento', 'fecha_atencion']);
  if (rawDate) {
    const value = String(rawDate).trim();
    const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const local = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (local) {
      const year = Number(local[3]) < 100 ? Number(local[3]) + 2000 : Number(local[3]);
      return new Date(year, Number(local[2]) - 1, Number(local[1]));
    }
  }

  const year = Number(readField(row, ['anio', 'ano', 'año', 'ANIO', 'AÑO']));
  const month = Number(readField(row, ['mes', 'MES']));
  const day = Number(readField(row, ['dia', 'día', 'DIA'])) || 1;
  if (year && month) return new Date(year, month - 1, day);
  return null;
};

const getConsultorio = (row) =>
  String(readField(row, ['consultorio', 'CONSULTORIO', 'numero_consultorio']) || 'Sin consultorio').trim();

const getWeekRanges = (year, month) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  for (let start = 1; start <= lastDay; start += 7) {
    const end = Math.min(start + 6, lastDay);
    weeks.push({ start, end });
  }
  return weeks;
};

const formatWeek = ({ start, end }, index, month) =>
  `S${index + 1} (${String(start).padStart(2, '0')}-${MONTHS[month].toLowerCase()} al ${String(end).padStart(2, '0')}-${MONTHS[month].toLowerCase()})`;

const getCellTone = (value) => {
  if (value >= 24) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (value >= 16) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (value >= 1) return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-slate-50 text-slate-400 border-slate-100';
};

export default function DashboardIndicadores() {
  const now = new Date();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('mensual');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    let alive = true;
    axios
      .get('/api/api_productividad.php')
      .then((response) => {
        if (alive && Array.isArray(response.data)) setRecords(response.data);
      })
      .catch(() => {
        if (alive) setRecords([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const years = useMemo(() => {
    const found = new Set(records.map(parseDate).filter(Boolean).map((date) => date.getFullYear()));
    found.add(now.getFullYear());
    return [...found].sort((a, b) => b - a);
  }, [records, now]);

  const monthRecords = useMemo(() => {
    return records.filter((row) => {
      const date = parseDate(row);
      if (!date || date.getFullYear() !== Number(year)) return false;
      if (mode === 'acumulado') return date.getMonth() <= Number(month);
      return date.getMonth() === Number(month);
    });
  }, [records, month, mode, year]);

  const weeklyData = useMemo(() => {
    const weeks = getWeekRanges(Number(year), Number(month));
    return weeks.map((week) => {
      const total = monthRecords.filter((row) => {
        const date = parseDate(row);
        return date && date.getMonth() === Number(month) && date.getDate() >= week.start && date.getDate() <= week.end;
      }).length;
      return total;
    });
  }, [monthRecords, month, year]);

  const tableData = useMemo(() => {
    const days = Array.from({ length: new Date(Number(year), Number(month) + 1, 0).getDate() }, (_, index) => index + 1);
    const grouped = new Map();
    monthRecords.forEach((row) => {
      const date = parseDate(row);
      if (!date || date.getMonth() !== Number(month)) return;
      const consultorio = getConsultorio(row);
      if (!grouped.has(consultorio)) grouped.set(consultorio, {});
      const bucket = grouped.get(consultorio);
      bucket[date.getDate()] = (bucket[date.getDate()] || 0) + 1;
    });

    const rows = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .slice(0, 20)
      .map(([consultorio, values]) => ({
        consultorio,
        values,
        total: days.reduce((sum, day) => sum + (values[day] || 0), 0),
      }));

    return { days, rows };
  }, [monthRecords, month, year]);

  const chartData = useMemo(() => {
    const weeks = getWeekRanges(Number(year), Number(month));
    return {
      labels: weeks.map((week, index) => formatWeek(week, index, Number(month))),
      datasets: [
        {
          label: 'Consultas Reales',
          data: weeklyData,
          borderColor: '#07958a',
          backgroundColor: 'rgba(7, 149, 138, 0.12)',
          borderWidth: 4,
          pointRadius: 7,
          pointHoverRadius: 8,
          pointBackgroundColor: '#07958a',
          pointBorderColor: '#07958a',
          tension: 0.25,
          fill: false,
        },
        {
          label: 'Meta Esperada',
          data: weeklyData.map(() => META_SEMANAL),
          borderColor: '#64748b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 6],
          pointRadius: 0,
          tension: 0,
        },
      ],
    };
  }, [month, weeklyData, year]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 48,
          color: '#475569',
          font: { size: 13, weight: 600 },
        },
      },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#475569', font: { size: 12 } },
      },
      y: {
        beginAtZero: true,
        suggestedMax: 3000,
        ticks: { color: '#475569' },
        grid: { color: '#edf2f7' },
      },
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-80 border-r border-slate-200 bg-white lg:block">
        <div className="px-7 py-6">
          <p className="mb-8 text-xs font-black uppercase tracking-widest text-slate-400">Categorias</p>
          <button className="mb-4 flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left font-bold text-slate-500 hover:bg-slate-50">
            <Grid2X2 size={22} />
            Indicadores HOSP
          </button>
          <button className="flex w-full items-center gap-4 rounded-xl bg-emerald-600 px-5 py-4 text-left font-black text-white shadow-lg shadow-emerald-200">
            <UsersRound size={22} />
            Ind. Consulta Externa
          </button>
        </div>
      </aside>

      <main className="lg:pl-80">
        <header className="sticky top-0 z-10 flex min-h-[108px] flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-5">
            <button className="hidden h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-md lg:flex">
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Indicadores: Consulta Externa
            </h1>
          </div>
          <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
            <button
              onClick={() => setMode('mensual')}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 font-black transition ${
                mode === 'mensual' ? 'bg-white text-emerald-700 shadow' : 'text-slate-400'
              }`}
            >
              <CalendarDays size={18} />
              Mensual
            </button>
            <button
              onClick={() => setMode('acumulado')}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 font-black transition ${
                mode === 'acumulado' ? 'bg-white text-emerald-700 shadow' : 'text-slate-400'
              }`}
            >
              <BarChart3 size={18} />
              Acumulado
            </button>
          </div>
        </header>

        <section className="space-y-10 px-6 py-10 lg:px-10">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Target size={27} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Cumplimiento de Metas Semanales</h2>
                  <p className="font-semibold text-slate-500">Calendario Operativo IMSS</p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-inner xl:w-auto">
                <Filter size={19} className="text-slate-400" />
                <select
                  className="bg-transparent font-black text-emerald-700 outline-none"
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                >
                  {MONTH_OPTIONS.map((label, index) => (
                    <option key={label} value={index}>
                      {label.slice(0, 3)}
                    </option>
                  ))}
                </select>
                <div className="h-5 w-px bg-slate-300" />
                <select
                  className="bg-transparent font-black text-emerald-700 outline-none"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                >
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="h-[380px]">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-8 flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <ClipboardList size={27} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Productividad Diaria por Consultorio</h2>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-black">
                  <span className="rounded bg-emerald-50 px-3 py-1 text-emerald-700">Optimo (&gt;=24)</span>
                  <span className="rounded bg-amber-50 px-3 py-1 text-amber-700">Regular (16-23)</span>
                  <span className="rounded bg-rose-50 px-3 py-1 text-rose-700">Bajo (1-15)</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-44 bg-slate-100 px-4 py-4 text-left font-black">
                      Consultorio
                    </th>
                    {tableData.days.map((day) => (
                      <th key={day} className="min-w-16 px-3 py-3 text-center font-black">
                        <span className="block">{day}</span>
                        <span className="text-[10px] uppercase">{MONTHS[month]}</span>
                      </th>
                    ))}
                    <th className="min-w-20 px-4 py-4 text-center font-black">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={tableData.days.length + 2} className="px-5 py-12 text-center font-bold text-slate-400">
                        {loading ? 'Cargando datos...' : 'Sin datos de consulta externa para el periodo seleccionado.'}
                      </td>
                    </tr>
                  ) : (
                    tableData.rows.map((row) => (
                      <tr key={row.consultorio} className="border-t border-slate-100">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 font-black text-slate-600">
                          {row.consultorio}
                        </td>
                        {tableData.days.map((day) => {
                          const value = row.values[day] || 0;
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <span className={`inline-flex h-9 min-w-10 items-center justify-center rounded-lg border px-2 text-xs font-black ${getCellTone(value)}`}>
                                {value}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center font-black text-slate-700">{row.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
