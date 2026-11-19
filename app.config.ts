export default defineAppConfig({
  ui: {
    colors: {
      primary: 'lumen',
      neutral: 'stone',
    },
    button: {
      slots: {
        base: 'max-sm:min-h-11',
      },
      variants: {
        square: {
          true: {
            base: 'max-sm:min-w-11 max-sm:justify-center',
          },
        },
      },
      defaultVariants: {
        color: 'primary',
      },
    },
    input: {
      slots: {
        base: 'max-sm:min-h-11 max-sm:text-base',
      },
    },
    select: {
      slots: {
        base: 'max-sm:min-h-11 max-sm:text-base',
      },
    },
    selectMenu: {
      slots: {
        base: 'max-sm:min-h-11 max-sm:text-base',
      },
    },
    inputNumber: {
      slots: {
        base: 'max-sm:min-h-11 max-sm:text-base',
      },
    },
    textarea: {
      slots: {
        base: 'max-sm:text-base',
      },
    },
    modal: {
      slots: {
        header: 'shrink-0 items-start pe-12',
        wrapper: 'min-w-0',
        body: 'min-h-0 overscroll-contain',
        footer: 'shrink-0',
        title: 'text-pretty',
        description: 'text-pretty',
      },
    },
    slideover: {
      slots: {
        header: 'shrink-0 items-start pe-12',
        wrapper: 'min-w-0',
        body: 'min-h-0 overscroll-contain',
        footer: 'shrink-0',
        title: 'text-pretty',
        description: 'text-pretty',
      },
    },
    popover: {
      slots: {
        content: 'max-sm:max-h-[min(24rem,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem))] max-sm:overflow-y-auto',
      },
    },
    container: {
      base: 'w-full max-w-none mx-auto px-4 sm:px-6 lg:px-8',
    },
  },
})
