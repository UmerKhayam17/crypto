import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/context/theme";
import { StoreProvider } from "@/context/store";
import { Toaster } from "@/components/ui/sonner";
import { NotFoundPage } from "@/components/not-found";

import IndexPage from "@/routes/index";
import LoginPage from "@/routes/login";
import RegisterPage from "@/routes/register";
import MarketsPage from "@/routes/markets";
import TradePage from "@/routes/trade";
import PortfolioPage from "@/routes/portfolio";
import ProfilePage from "@/routes/profile";
import KycPage from "@/routes/kyc";
import DepositPage from "@/routes/deposit";
import WithdrawPage from "@/routes/withdraw";
import RechargeActivityPage from "@/routes/recharge-activity";
import SupportPage from "@/routes/support";
import AdminPage from "@/routes/admin";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <StoreProvider>
          <Routes>
            <Route path="/" element={<IndexPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/kyc" element={<KycPage />} />
            <Route path="/deposit" element={<DepositPage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/recharge-activity" element={<RechargeActivityPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
          <Toaster />
        </StoreProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
