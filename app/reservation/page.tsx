import SpinBookingWidget from "@/components/SpinBookingWidget";

export default function ReservationPage() {
  return (
    <main
      style={{
        backgroundColor: "#ffffff",
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <SpinBookingWidget />
    </main>
  );
}