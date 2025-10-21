import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "PWI 2 Machine Monitoring System - SPC",
  description: "PWI 2 Machine Monitoring System - SPC",
};

export default function SignIn() {
  return <SignInForm />;
}
