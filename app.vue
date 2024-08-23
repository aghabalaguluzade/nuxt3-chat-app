<template>
  <NuxtLayout>
    <UContainer :ui="{ base: 'mt-10' }">
      <NuxtLoadingIndicator />
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </UContainer>
  </NuxtLayout>
</template>