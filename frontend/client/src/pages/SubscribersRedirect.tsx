import React, { useEffect } from "react";
import { useLocation } from "wouter";

export default function SubscribersRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/settings/users");
  }, [setLocation]);

  return null;
}

