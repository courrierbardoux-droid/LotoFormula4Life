import React, { useEffect } from "react";
import { useLocation } from "wouter";

export default function PopupEmailManagementRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/settings/popups-emails");
  }, [setLocation]);

  return null;
}

