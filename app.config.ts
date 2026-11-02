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
    container: {
      base: 'w-full max-w-none mx-auto px-4 sm:px-6 lg:px-8',
    },
  },
})
