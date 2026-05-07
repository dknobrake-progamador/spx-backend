type BarcodePageLock = {
  text: {
    resultTitle: string;
    vehicleType: string;
    vehiclePlate: string;
  };
  breakpoints: {
    largeScreenMin: number;
    largePhoneMin: number;
  };
  barcode: {
    tabletWidth: number;
    phoneWidthMax: number;
    phoneWidthMin: number;
    phoneWidthSubtract: number;
    largePhoneWidthMax: number;
    largePhoneWidthMin: number;
    largePhoneWidthSubtract: number;
    defaultHeight: number;
    largePhoneHeight: number;
    quietZone: number;
  };
  svg: {
    width: number;
    height: number;
    barcodeDrawWidth: number;
    barcodeOffsetX: number;
    barcodeOffsetY: number;
    barcodeHeight: number;
  };
  layout: {
    topbar: {
      paddingTop: number;
      paddingBottom: number;
      paddingHorizontal: number;
    };
    topbarLargePhone: {
      paddingTop: number;
      paddingBottom: number;
      paddingHorizontal: number;
    };
    body: {
      paddingHorizontal: number;
      paddingVertical: number;
      gap: number;
    };
    bodyLargePhone: {
      paddingHorizontal: number;
      paddingVertical: number;
      gap: number;
    };
    resultCard: {
      paddingHorizontal: number;
      paddingTop: number;
      paddingBottom: number;
      radius: number;
      borderWidth: number;
    };
    resultCardLargePhone: {
      paddingHorizontal: number;
      paddingTop: number;
      paddingBottom: number;
    };
    resultCardLarge: {
      maxWidth: number;
    };
    personName: {
      fontSize: number;
      letterSpacing: number;
      marginBottom: number;
    };
    personNameLargePhone: {
      fontSize: number;
      marginBottom: number;
    };
    personId: {
      fontSize: number;
      letterSpacing: number;
      marginBottom: number;
    };
    personIdLargePhone: {
      marginBottom: number;
    };
    barcodeWrapLargePhone: {
      marginTop: number;
    };
    infoCardLarge: {
      maxWidth: number;
    };
    infoRow: {
      paddingHorizontal: number;
      paddingVertical: number;
    };
    infoRowLargePhone: {
      paddingHorizontal: number;
      paddingVertical: number;
    };
  };
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export const BARCODE_PAGE_LOCK = deepFreeze<BarcodePageLock>({
  text: {
    resultTitle: "C\u00f3digo de barras",
    vehicleType: "Tipo do ve\u00edculo",
    vehiclePlate: "Placa do Ve\u00edculo",
  },
  breakpoints: {
    largeScreenMin: 768,
    largePhoneMin: 410,
  },
  barcode: {
    tabletWidth: 340,
    phoneWidthMax: 340,
    phoneWidthMin: 250,
    phoneWidthSubtract: 80,
    largePhoneWidthMax: 276,
    largePhoneWidthMin: 232,
    largePhoneWidthSubtract: 148,
    defaultHeight: 110,
    largePhoneHeight: 92,
    quietZone: 0,
  },
  svg: {
    width: 390,
    height: 844,
    barcodeDrawWidth: 340,
    barcodeOffsetX: 25,
    barcodeOffsetY: 214,
    barcodeHeight: 110,
  },
  layout: {
    topbar: {
      paddingTop: 48,
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    topbarLargePhone: {
      paddingTop: 42,
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    body: {
      paddingHorizontal: 14,
      paddingVertical: 16,
      gap: 12,
    },
    bodyLargePhone: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
    },
    resultCard: {
      paddingHorizontal: 20,
      paddingTop: 30,
      paddingBottom: 26,
      radius: 14,
      borderWidth: 1,
    },
    resultCardLargePhone: {
      paddingHorizontal: 16,
      paddingTop: 22,
      paddingBottom: 18,
    },
    resultCardLarge: {
      maxWidth: 520,
    },
    personName: {
      fontSize: 22,
      letterSpacing: 1.8,
      marginBottom: 6,
    },
    personNameLargePhone: {
      fontSize: 20,
      marginBottom: 4,
    },
    personId: {
      fontSize: 14,
      letterSpacing: 0.5,
      marginBottom: 22,
    },
    personIdLargePhone: {
      marginBottom: 14,
    },
    barcodeWrapLargePhone: {
      marginTop: -2,
    },
    infoCardLarge: {
      maxWidth: 520,
    },
    infoRow: {
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    infoRowLargePhone: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
  },
});

export function assertBarcodePageLock() {
  const lock = BARCODE_PAGE_LOCK;
  const isValid =
    lock.text.resultTitle === "C\u00f3digo de barras" &&
    lock.text.vehicleType === "Tipo do ve\u00edculo" &&
    lock.text.vehiclePlate === "Placa do Ve\u00edculo" &&
    lock.breakpoints.largeScreenMin === 768 &&
    lock.breakpoints.largePhoneMin === 410 &&
    lock.barcode.tabletWidth === 340 &&
    lock.barcode.phoneWidthMax === 340 &&
    lock.barcode.phoneWidthMin === 250 &&
    lock.barcode.phoneWidthSubtract === 80 &&
    lock.barcode.largePhoneWidthMax === 276 &&
    lock.barcode.largePhoneWidthMin === 232 &&
    lock.barcode.largePhoneWidthSubtract === 148 &&
    lock.barcode.defaultHeight === 110 &&
    lock.barcode.largePhoneHeight === 92 &&
    lock.barcode.quietZone === 0 &&
    lock.svg.width === 390 &&
    lock.svg.height === 844 &&
    lock.svg.barcodeDrawWidth === 340 &&
    lock.svg.barcodeOffsetX === 25 &&
    lock.svg.barcodeOffsetY === 214 &&
    lock.svg.barcodeHeight === 110 &&
    lock.layout.topbar.paddingTop === 48 &&
    lock.layout.topbar.paddingBottom === 16 &&
    lock.layout.topbar.paddingHorizontal === 20 &&
    lock.layout.topbarLargePhone.paddingTop === 42 &&
    lock.layout.topbarLargePhone.paddingBottom === 12 &&
    lock.layout.topbarLargePhone.paddingHorizontal === 16 &&
    lock.layout.body.paddingHorizontal === 14 &&
    lock.layout.body.paddingVertical === 16 &&
    lock.layout.body.gap === 12 &&
    lock.layout.bodyLargePhone.paddingHorizontal === 12 &&
    lock.layout.bodyLargePhone.paddingVertical === 10 &&
    lock.layout.bodyLargePhone.gap === 10 &&
    lock.layout.resultCard.paddingHorizontal === 20 &&
    lock.layout.resultCard.paddingTop === 30 &&
    lock.layout.resultCard.paddingBottom === 26 &&
    lock.layout.resultCard.radius === 14 &&
    lock.layout.resultCard.borderWidth === 1 &&
    lock.layout.resultCardLargePhone.paddingHorizontal === 16 &&
    lock.layout.resultCardLargePhone.paddingTop === 22 &&
    lock.layout.resultCardLargePhone.paddingBottom === 18 &&
    lock.layout.resultCardLarge.maxWidth === 520 &&
    lock.layout.personName.fontSize === 22 &&
    lock.layout.personName.letterSpacing === 1.8 &&
    lock.layout.personName.marginBottom === 6 &&
    lock.layout.personNameLargePhone.fontSize === 20 &&
    lock.layout.personNameLargePhone.marginBottom === 4 &&
    lock.layout.personId.fontSize === 14 &&
    lock.layout.personId.letterSpacing === 0.5 &&
    lock.layout.personId.marginBottom === 22 &&
    lock.layout.personIdLargePhone.marginBottom === 14 &&
    lock.layout.barcodeWrapLargePhone.marginTop === -2 &&
    lock.layout.infoCardLarge.maxWidth === 520 &&
    lock.layout.infoRow.paddingHorizontal === 18 &&
    lock.layout.infoRow.paddingVertical === 16 &&
    lock.layout.infoRowLargePhone.paddingHorizontal === 16 &&
    lock.layout.infoRowLargePhone.paddingVertical === 12;

  if (!isValid) {
    throw new Error("BarcodePageLockViolation: a estrutura protegida da tela foi alterada.");
  }
}

export function getLockedBarcodeMetrics(width: number) {
  const largeScreen = width >= BARCODE_PAGE_LOCK.breakpoints.largeScreenMin;
  const largePhone =
    width >= BARCODE_PAGE_LOCK.breakpoints.largePhoneMin &&
    width < BARCODE_PAGE_LOCK.breakpoints.largeScreenMin;

  const barcodeHeight = largePhone
    ? BARCODE_PAGE_LOCK.barcode.largePhoneHeight
    : BARCODE_PAGE_LOCK.barcode.defaultHeight;

  const barcodeWidth = largeScreen
    ? BARCODE_PAGE_LOCK.barcode.tabletWidth
    : largePhone
      ? Math.min(
          BARCODE_PAGE_LOCK.barcode.largePhoneWidthMax,
          Math.max(
            BARCODE_PAGE_LOCK.barcode.largePhoneWidthMin,
            width - BARCODE_PAGE_LOCK.barcode.largePhoneWidthSubtract
          )
        )
      : Math.min(
          BARCODE_PAGE_LOCK.barcode.phoneWidthMax,
          Math.max(
            BARCODE_PAGE_LOCK.barcode.phoneWidthMin,
            width - BARCODE_PAGE_LOCK.barcode.phoneWidthSubtract
          )
        );

  return {
    largeScreen,
    largePhone,
    barcodeHeight,
    barcodeWidth,
  };
}
