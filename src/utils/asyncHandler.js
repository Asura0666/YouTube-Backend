const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((error) =>
      next(error)
    );
  };
};

export { asyncHandler };

// const asyncHandler = (func = async (req, res, next) => {
//   try {
//     await function(req, res, next) {}
//   } catch (error) {
//     console.log();
//     res.status(error.code || 500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });
