"use client";

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, BlobProvider } from "@react-pdf/renderer";

interface ReceiptData {
  receiptNumber: string;
  beneficiaryName: string;
  tutorName?: string;
  planName: string;
  startDate: string;
  endDate: string;
  amount: number;
  method: string;
  issuedAt: string;
  notes?: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  header: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: "#ff544c", paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#131313", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 2 },
  receiptNumber: { fontSize: 10, color: "#999", marginTop: 8 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#ff544c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  label: { fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 11, color: "#131313", fontWeight: "bold" },
  valueNormal: { fontSize: 11, color: "#131313" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 2, borderTopColor: "#ff544c", marginTop: 10 },
  totalLabel: { fontSize: 12, fontWeight: "bold", color: "#131313" },
  totalValue: { fontSize: 14, fontWeight: "bold", color: "#ff544c" },
  footer: { marginTop: 40, paddingTop: 20, borderTopWidth: 0.5, borderTopColor: "#ddd" },
  footerText: { fontSize: 9, color: "#999", textAlign: "center", lineHeight: 1.5 },
  notes: { marginTop: 10, padding: 10, backgroundColor: "#f9f9f9", borderRadius: 4 },
  notesText: { fontSize: 9, color: "#666", lineHeight: 1.5 },
});

function ReceiptDocument({ data }: { data: ReceiptData }) {
  const methodLabels: Record<string, string> = {
    transferencia: "Transferencia bancaria",
    efectivo: "Efectivo",
    flow: "Flow (online)",
    otro: "Otro",
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>ZONAELITE</Text>
          <Text style={styles.subtitle}>Academia de Artes Marciales</Text>
          <Text style={styles.receiptNumber}>Recibo N° {data.receiptNumber}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Beneficiario</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre</Text>
            <Text style={styles.value}>{data.beneficiaryName}</Text>
          </View>
          {data.tutorName && (
            <View style={styles.row}>
              <Text style={styles.label}>Tutor</Text>
              <Text style={styles.valueNormal}>{data.tutorName}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membresía Asignada</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Plan</Text>
            <Text style={styles.value}>{data.planName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha de inicio</Text>
            <Text style={styles.valueNormal}>{new Date(data.startDate).toLocaleDateString("es-CL")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha de vencimiento</Text>
            <Text style={styles.valueNormal}>{new Date(data.endDate).toLocaleDateString("es-CL")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pago</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Método de pago</Text>
            <Text style={styles.valueNormal}>{methodLabels[data.method] || data.method}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total pagado</Text>
            <Text style={styles.totalValue}>${data.amount.toLocaleString("es-CL")}</Text>
          </View>
        </View>

        {data.notes && (
          <View style={styles.notes}>
            <Text style={styles.label}>Notas</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Recibo generado el {new Date(data.issuedAt).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
          <Text style={styles.footerText}>
            ZONAELITE — Academia de Kenpo, Kickboxing y Sport Kempo en La Serena
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default function MembershipReceipt({ data }: { data: ReceiptData }) {
  return (
    <PDFDownloadLink
      document={<ReceiptDocument data={data} />}
      fileName={`recibo-${data.receiptNumber}.pdf`}
      className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
    >
      {({ loading }) => (
        <>
          <span className="material-symbols-outlined text-[18px]">{loading ? "hourglass_empty" : "picture_as_pdf"}</span>
          <span className="font-[family-name:var(--font-body-md)] text-[13px]">{loading ? "Generando..." : "Recibo"}</span>
        </>
      )}
    </PDFDownloadLink>
  );
}

export type { ReceiptData };
