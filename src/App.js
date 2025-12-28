import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import { saveAs } from "file-saver";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

/* ===== FIREBASE CONFIG (JANGAN DIUBAH) ===== */
const firebaseConfig = {
  apiKey: "AIzaSyDjn1j6KXaJlHTP9B2Si1FDdpGH0VF6-fA",
  authDomain: "penyiraman-otomatis-99.firebaseapp.com",
  databaseURL: "https://penyiraman-otomatis-99-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "penyiraman-otomatis-99",
  storageBucket: "penyiraman-otomatis-99.firebasestorage.app",
  messagingSenderId: "192163471491",
  appId: "1:192163471491:web:d7a30ac300737dfd3b7bb6"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ===== DEVICE ===== */
const DEVICES = {
  vU2AHfvDz4TUo700miJjZ2LuGDK2: "Sprinkler Irrigation",
  gGuzIhBcpJbUfZGEXSEKxf2Alnr2: "Subsurface Drip Irrigation"
};

export default function App() {
  const [logs, setLogs] = useState([]);
  const [latest, setLatest] = useState({});
  const [deviceFilter, setDeviceFilter] = useState("ALL");
  const [chartType, setChartType] = useState("moisture");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  /* ===== AMAN PARSE WAKTU ===== */
  const parseTime = (v) => {
    if (v?.date_time) {
      const t = new Date(v.date_time.replace(" ", "T")).getTime();
      if (!isNaN(t)) return t;
    }
    if (v?.timestamp) {
      const ts = Number(v.timestamp);
      if (!isNaN(ts)) return ts.toString().length <= 10 ? ts * 1000 : ts;
    }
    return 0;
  };

  /* ===== AMBIL DATA FIREBASE ===== */
  useEffect(() => {
    Object.keys(DEVICES).forEach((id) => {
      const deviceRef = ref(db, `irrigation/${id}`);
      onValue(deviceRef, (snap) => {
        const data = snap.val();
        if (!data) return;

        const rows = Object.entries(data).map(([key, v]) => ({
          id: key,
          deviceId: id,
          deviceName: DEVICES[id],
          date_time: v?.date_time ?? "-",
          soil_moisture: Number(v?.soil_moisture ?? 0),
          pump_state: v?.pump_state ?? "-",
          pump_duration_sec: Number(v?.pump_duration_sec ?? 0),
          water_volume_ml: Number(v?.water_volume_ml ?? 0),
          timeMs: parseTime(v)
        }));

        rows.sort((a, b) => b.timeMs - a.timeMs);
        setLatest(p => ({ ...p, [id]: rows[0] }));
        setLogs(p => [...p.filter(r => r.deviceId !== id), ...rows]);
      });
    });
  }, []);

  /* ===== FILTER TANGGAL ===== */
  const filteredByDate = logs.filter(r => {
    const start = startDate ? new Date(startDate).setHours(0,0,0,0) : -Infinity;
    const end = endDate ? new Date(endDate).setHours(23,59,59,999) : Infinity;
    return r.timeMs >= start && r.timeMs <= end;
  });

  /* ===== FILTER DEVICE ===== */
  const filteredLogs =
    deviceFilter === "ALL"
      ? filteredByDate
      : filteredByDate.filter(r => r.deviceId === deviceFilter);

  /* ===== DATA GRAFIK PER DEVICE ===== */
  const sprinklerData = filteredLogs
    .filter(r => r.deviceId === "vU2AHfvDz4TUo700miJjZ2LuGDK2")
    .slice(0, 20)
    .reverse();

  const subsurfaceData = filteredLogs
    .filter(r => r.deviceId === "gGuzIhBcpJbUfZGEXSEKxf2Alnr2")
    .slice(0, 20)
    .reverse();

  /* ===== TABEL 10 DATA TERBARU ===== */
  const tableData = [...filteredLogs]
    .sort((a, b) => b.timeMs - a.timeMs)
    .slice(0, 10);

  /* ===== DOWNLOAD CSV ===== */
  const downloadCSV = () => {
    let csv = "Device,Date Time,Moisture (%),Pump State,Pump Duration (sec),Water Volume (ml)\n";
    filteredLogs.forEach(r => {
      csv += `${r.deviceName},${r.date_time},${r.soil_moisture},${r.pump_state},${r.pump_duration_sec},${r.water_volume_ml}\n`;
    });
    saveAs(new Blob([csv]), "irrigation_data.csv");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard Penyiraman Otomatis</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <select onChange={e => setDeviceFilter(e.target.value)}>
          <option value="ALL">Semua Perangkat</option>
          {Object.keys(DEVICES).map(id => (
            <option key={id} value={id}>{DEVICES[id]}</option>
          ))}
        </select>
        <button onClick={downloadCSV}>Download CSV</button>
      </div>

      {/* INFO REALTIME */}
      <div style={{ display: "flex", gap: 16 }}>
        {Object.keys(DEVICES).map(id => (
          <div key={id} style={{ border: "1px solid #ccc", padding: 16, width: "50%" }}>
            <h3>{DEVICES[id]}</h3>
            {latest[id] ? (
              <>
                <p>Kelembapan: {latest[id].soil_moisture}%</p>
                <p>Status Pompa: {latest[id].pump_state}</p>
                <p>Durasi Pompa: {latest[id].pump_duration_sec} sec</p>
                <p>Volume Air: {latest[id].water_volume_ml} ml</p>
                <p>Update: {latest[id].date_time}</p>
              </>
            ) : "Memuat..."}
          </div>
        ))}
      </div>

      {/* GRAFIK */}
      <h2>Grafik</h2>
      <select onChange={e => setChartType(e.target.value)}>
        <option value="moisture">Kelembapan</option>
        <option value="volume">Volume Air</option>
      </select>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date_time" />
          <YAxis />
          <Tooltip />
          <Legend />

          <Line
            data={sprinklerData}
            type="monotone"
            dataKey={chartType === "moisture" ? "soil_moisture" : "water_volume_ml"}
            stroke="#1976d2"
            name="Sprinkler Irrigation"
          />

          <Line
            data={subsurfaceData}
            type="monotone"
            dataKey={chartType === "moisture" ? "soil_moisture" : "water_volume_ml"}
            stroke="#d32f2f"
            name="Subsurface Drip Irrigation"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* TABEL */}
      <h2>10 Data Terbaru</h2>
      <table border="1" width="100%" cellPadding="6">
        <thead>
          <tr>
            <th>Perangkat</th>
            <th>Waktu</th>
            <th>Kelembapan (%)</th>
            <th>Status Pompa</th>
            <th>Durasi (sec)</th>
            <th>Volume (ml)</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((r, i) => (
            <tr key={i}>
              <td>{r.deviceName}</td>
              <td>{r.date_time}</td>
              <td>{r.soil_moisture}</td>
              <td>{r.pump_state}</td>
              <td>{r.pump_duration_sec}</td>
              <td>{r.water_volume_ml}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
